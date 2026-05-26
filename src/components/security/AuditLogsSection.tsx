import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Shield,
  Key,
  Smartphone,
  LogOut,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  History,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { accountService } from '../../services/accountService';
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  xs: 10,
  sm: 13,
  md: 18,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  xxs: 2,
  xs: 3,
  sm: 4,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  xxxl: 16,
  s24: 24,
  s32: 32,
  s40: 40,
  s56: 56,
};
const RADIUS = {
  md: 12,
  lg: 16,
  xl: 20,
  panel: 24,
  full: 28,
};
const LETTER_SPACING = {
  wide: 1,
};

const getLogIcon = (type: string) => {
  switch (type) {
    case 'password_change': return { Icon: Key, color: THEME_COLORS.primary, bg: THEME_COLORS.successTintSoft };
    case '2fa_toggle': return { Icon: Smartphone, color: THEME_COLORS.brandBlueText, bg: THEME_COLORS.infoTintSoft };
    case 'login': return { Icon: Shield, color: THEME_COLORS.success, bg: THEME_COLORS.successTintSoftAlt };
    case 'logout': return { Icon: LogOut, color: THEME_COLORS.neutralTextSubtle, bg: THEME_COLORS.neutralTintSoft };
    case 'failed_login': return { Icon: ShieldAlert, color: THEME_COLORS.errorStrong, bg: THEME_COLORS.errorTintSoft };
    default: return { Icon: History, color: THEME_COLORS.neutralTextSubtle, bg: THEME_COLORS.neutralTintSoft };
  }
};

export const AuditLogsSection: React.FC = () => {
  const { userProfile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) return;
    accountService
      .getAuditLogs()
      .then(setLogs)
      .catch((e) => console.error('Failed to fetch audit logs:', e))
      .finally(() => setLoading(false));
  }, [userProfile]);

  return (
    <View style={{ backgroundColor: THEME_COLORS.white, borderRadius: RADIUS.panel, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft, padding: SPACE.s24, gap: SPACE.xxxl }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl }}>
          <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.infoTintSoft, alignItems: 'center', justifyContent: 'center' }}>
            <History size={22} color={THEME_COLORS.brandBlueText} />
          </View>
          <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>Security Activity</Text>
        </View>
        <TouchableOpacity>
          <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.brandBlueText, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>View All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingVertical: SPACE.s24, alignItems: 'center' }}>
          <ActivityIndicator color={THEME_COLORS.primary} />
        </View>
      ) : logs.length > 0 ? (
        <View style={{ gap: SPACE.md }}>
          {logs.map((log) => {
            const { Icon, color, bg } = getLogIcon(log.type);
            return (
              <View
                key={log.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: SPACE.xl,
                  padding: SPACE.xxl,
                  backgroundColor: THEME_COLORS.surfaceContainerLow,
                  borderRadius: RADIUS.lg,
                }}
              >
                <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }} numberOfLines={1}>
                    {log.message || 'Security event'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, marginTop: SPACE.xxs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
                      <Clock size={10} color={THEME_COLORS.neutralTextSoft} />
                      <Text style={{ fontSize: TYPE_SCALE.xs, color: THEME_COLORS.neutralTextSoft }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    {log.ip && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
                        <Shield size={10} color={THEME_COLORS.neutralTextSoft} />
                        <Text style={{ fontSize: TYPE_SCALE.xs, color: THEME_COLORS.neutralTextSoft }}>{log.ip}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {log.status === 'success' ? (
                  <CheckCircle2 size={SPACE.xxxl} color={THEME_COLORS.success} />
                ) : log.status === 'failure' ? (
                  <AlertTriangle size={SPACE.xxxl} color={THEME_COLORS.errorStrong} />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ paddingVertical: SPACE.s32, alignItems: 'center', gap: SPACE.xl, backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, borderWidth: SPACE.xxs, borderColor: THEME_COLORS.alias_rgba_0_0_0_0_04, borderStyle: 'dashed' }}>
          <View style={{ width: SPACE.s56, height: SPACE.s56, borderRadius: RADIUS.full, backgroundColor: THEME_COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
            <History size={28} color={THEME_COLORS.alias_rgba_0_0_0_0_15} />
          </View>
          <View style={{ alignItems: 'center', gap: SPACE.sm }}>
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSoft }}>No recent activity</Text>
            <Text style={{ fontSize: TYPE_SCALE.xs, color: THEME_COLORS.alias_rgba_136_136_136_0_6 }}>Your security events will appear here</Text>
          </View>
        </View>
      )}
    </View>
  );
};
