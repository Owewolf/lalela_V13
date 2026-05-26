import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Laptop,
  Smartphone,
  LogOut,
  ShieldAlert,
  MapPin,
  Globe,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { accountService } from '../../services/accountService';
import { UserSession } from '../../types';
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  xs: 9,
  sm: 10,
  md: 12,
  body: 13,
  title: 18,
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
  xxl: 16,
  s20: 20,
  s24: 24,
  s32: 32,
  s40: 40,
  s44: 44,
  s56: 56,
};
const RADIUS = {
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 28,
};
const LETTER_SPACING = {
  normal: 1,
};

export const SessionsSection: React.FC = () => {
  const { userProfile } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const fetchSessions = async () => {
    try {
      const data = await accountService.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userProfile) return;
    fetchSessions();
  }, [userProfile]);

  const handleLogoutSession = async (sessionId: string) => {
    try {
      await accountService.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (error) {
      console.error('Failed to logout session:', error);
    }
  };

  const handleLogoutAll = async () => {
    if (sessions.length <= 1) return;
    setIsRevokingAll(true);
    try {
      await accountService.revokeAllOtherSessions();
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    } catch (error) {
      console.error('Failed to logout all sessions:', error);
    } finally {
      setIsRevokingAll(false);
    }
  };

  return (
    <View style={{ backgroundColor: THEME_COLORS.white, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft, padding: SPACE.s24, gap: SPACE.xxl }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl }}>
          <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.infoTintSoft, alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} color={THEME_COLORS.brandBlueText} />
          </View>
          <Text style={{ fontSize: TYPE_SCALE.title, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>Active Sessions</Text>
        </View>
        {sessions.length > 1 && (
          <TouchableOpacity onPress={handleLogoutAll} disabled={isRevokingAll}>
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.errorStrong, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal, opacity: isRevokingAll ? 0.5 : 1 }}>
              {isRevokingAll ? 'Revoking...' : 'Logout All Others'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSoft }}>
        You're currently logged into these devices. Revoke any session you don't recognize.
      </Text>

      {loading ? (
        <View style={{ paddingVertical: SPACE.s24, alignItems: 'center' }}>
          <ActivityIndicator color={THEME_COLORS.primary} />
        </View>
      ) : sessions.length > 0 ? (
        <View style={{ gap: SPACE.lg }}>
          {sessions.map((session) => {
            const isMobile =
              session.device.toLowerCase().includes('phone') ||
              session.device.toLowerCase().includes('mobile');
            return (
              <View
                key={session.id}
                style={{
                  backgroundColor: THEME_COLORS.surfaceContainerLow,
                  borderRadius: RADIUS.xl,
                  padding: SPACE.xxl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl, flex: 1 }}>
                  <View style={{ width: SPACE.s44, height: SPACE.s44, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
                    {isMobile ? <Smartphone size={22} color={THEME_COLORS.neutralTextSubtle} /> : <Laptop size={22} color={THEME_COLORS.neutralTextSubtle} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>
                        {session.device || 'Unknown Device'}
                      </Text>
                      {session.isCurrent && (
                        <View style={{ backgroundColor: THEME_COLORS.successTintSoftAlt, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xxs, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: THEME_COLORS.successTintStrongAlt }}>
                          <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.successStrongAlt, textTransform: 'uppercase' }}>Current</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginTop: SPACE.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
                        <MapPin size={11} color={THEME_COLORS.neutralTextSoft} />
                        <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSoft }}>{session.location || 'Unknown'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
                        <Globe size={11} color={THEME_COLORS.neutralTextSoft} />
                        <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSoft }}>{session.ip || '—'}</Text>
                      </View>
                      <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSoft }}>
                        {new Date(session.lastActive).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>
                </View>
                {!session.isCurrent && (
                  <TouchableOpacity
                    onPress={() => handleLogoutSession(session.id)}
                    style={{ padding: SPACE.lg, borderRadius: RADIUS.md, backgroundColor: THEME_COLORS.alias_rgba_239_68_68_0_08, marginLeft: SPACE.md }}
                  >
                    <LogOut size={18} color={THEME_COLORS.errorStrong} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ paddingVertical: SPACE.s32, alignItems: 'center', gap: SPACE.lg, backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl }}>
          <View style={{ width: SPACE.s56, height: SPACE.s56, borderRadius: RADIUS.full, backgroundColor: THEME_COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
            <Laptop size={28} color={THEME_COLORS.alias_rgba_0_0_0_0_15} />
          </View>
          <Text style={{ fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSoft }}>No active sessions found</Text>
        </View>
      )}
    </View>
  );
};
