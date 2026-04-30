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
import { useFirebase } from '../../context/FirebaseContext';
import { accountService } from '../../services/accountService';

const getLogIcon = (type: string) => {
  switch (type) {
    case 'password_change': return { Icon: Key, color: '#0d3d47', bg: 'rgba(22,163,74,0.1)' };
    case '2fa_toggle': return { Icon: Smartphone, color: '#2563eb', bg: 'rgba(37,99,235,0.1)' };
    case 'login': return { Icon: Shield, color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
    case 'logout': return { Icon: LogOut, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
    case 'failed_login': return { Icon: ShieldAlert, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
    default: return { Icon: History, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
  }
};

export const AuditLogsSection: React.FC = () => {
  const { user } = useFirebase();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    accountService
      .getAuditLogs()
      .then(setLogs)
      .catch((e) => console.error('Failed to fetch audit logs:', e))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 24, gap: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(37,99,235,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <History size={22} color="#2563eb" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0d3d47' }}>Security Activity</Text>
        </View>
        <TouchableOpacity>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 1 }}>View All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color="#0d3d47" />
        </View>
      ) : logs.length > 0 ? (
        <View style={{ gap: 8 }}>
          {logs.map((log) => {
            const { Icon, color, bg } = getLogIcon(log.type);
            return (
              <View
                key={log.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 16,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }} numberOfLines={1}>
                    {log.message || 'Security event'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} color="#9ca3af" />
                      <Text style={{ fontSize: 10, color: '#9ca3af' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    {log.ip && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Shield size={10} color="#9ca3af" />
                        <Text style={{ fontSize: 10, color: '#9ca3af' }}>{log.ip}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {log.status === 'success' ? (
                  <CheckCircle2 size={16} color="#10b981" />
                ) : log.status === 'failure' ? (
                  <AlertTriangle size={16} color="#ef4444" />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ paddingVertical: 32, alignItems: 'center', gap: 12, backgroundColor: '#f5f5f5', borderRadius: 20, borderWidth: 2, borderColor: 'rgba(0,0,0,0.04)', borderStyle: 'dashed' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <History size={28} color="rgba(0,0,0,0.15)" />
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#888' }}>No recent activity</Text>
            <Text style={{ fontSize: 10, color: 'rgba(136,136,136,0.6)' }}>Your security events will appear here</Text>
          </View>
        </View>
      )}
    </View>
  );
};
