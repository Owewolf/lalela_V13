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
    <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 24, gap: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(37,99,235,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} color="#2563eb" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0d3d47' }}>Active Sessions</Text>
        </View>
        {sessions.length > 1 && (
          <TouchableOpacity onPress={handleLogoutAll} disabled={isRevokingAll}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1, opacity: isRevokingAll ? 0.5 : 1 }}>
              {isRevokingAll ? 'Revoking...' : 'Logout All Others'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={{ fontSize: 12, color: '#888' }}>
        You're currently logged into these devices. Revoke any session you don't recognize.
      </Text>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color="#0d3d47" />
        </View>
      ) : sessions.length > 0 ? (
        <View style={{ gap: 10 }}>
          {sessions.map((session) => {
            const isMobile =
              session.device.toLowerCase().includes('phone') ||
              session.device.toLowerCase().includes('mobile');
            return (
              <View
                key={session.id}
                style={{
                  backgroundColor: '#f5f5f5',
                  borderRadius: 20,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    {isMobile ? <Smartphone size={22} color="#6b7280" /> : <Laptop size={22} color="#6b7280" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }}>
                        {session.device || 'Unknown Device'}
                      </Text>
                      {session.isCurrent && (
                        <View style={{ backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#059669', textTransform: 'uppercase' }}>Current</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <MapPin size={11} color="#9ca3af" />
                        <Text style={{ fontSize: 10, color: '#9ca3af' }}>{session.location || 'Unknown'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Globe size={11} color="#9ca3af" />
                        <Text style={{ fontSize: 10, color: '#9ca3af' }}>{session.ip || '—'}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: '#9ca3af' }}>
                        {new Date(session.lastActive).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>
                </View>
                {!session.isCurrent && (
                  <TouchableOpacity
                    onPress={() => handleLogoutSession(session.id)}
                    style={{ padding: 10, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.08)', marginLeft: 8 }}
                  >
                    <LogOut size={18} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ paddingVertical: 32, alignItems: 'center', gap: 10, backgroundColor: '#f5f5f5', borderRadius: 20 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Laptop size={28} color="rgba(0,0,0,0.15)" />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#888' }}>No active sessions found</Text>
        </View>
      )}
    </View>
  );
};
