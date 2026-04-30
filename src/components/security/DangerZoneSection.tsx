import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { ShieldAlert, Trash2, LogOut } from 'lucide-react-native';
import { useFirebase } from '../../context/FirebaseContext';

export const DangerZoneSection: React.FC = () => {
  const { signOut, deleteAccount } = useFirebase();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Please sign out and sign back in to delete your account for security reasons.');
      } else {
        setError('Failed to delete account. Please try again later.');
      }
      setIsDeleting(false);
    }
  };

  return (
    <View style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(239,68,68,0.1)', padding: 24, gap: 20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldAlert size={22} color="#ef4444" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#ef4444' }}>Account Management</Text>
      </View>

      {error && (
        <View style={{ padding: 14, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#ef4444', textAlign: 'center' }}>{error}</Text>
        </View>
      )}

      <View style={{ gap: 14 }}>
        {/* Logout Card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 20, gap: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }}>Logout Account</Text>
            <Text style={{ fontSize: 10, color: '#888', lineHeight: 16 }}>
              Safely sign out of your account on this device. You can log back in anytime.
            </Text>
          </View>
          <TouchableOpacity
            onPress={signOut}
            style={{
              paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(22,163,74,0.06)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <LogOut size={16} color="#0d3d47" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0d3d47' }}>Logout Account</Text>
          </TouchableOpacity>
        </View>

        {/* Delete Card */}
        <View style={{ backgroundColor: '#ef4444', borderRadius: 24, padding: 20, gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Delete Account</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 16 }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowConfirmDelete(true)}
            style={{
              paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Trash2 size={16} color="#fff" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Delete Permanently</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Confirm Delete Modal */}
      <Modal
        visible={showConfirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!isDeleting) setShowConfirmDelete(false); }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 28,
            padding: 28,
            width: '100%',
            maxWidth: 360,
            gap: 20,
          }}>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={26} color="#ef4444" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' }}>
                Are you absolutely sure?
              </Text>
              <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 }}>
                This will permanently remove your account and all associated data. You will not be able to use this email to create a new account.
              </Text>
            </View>

            {error && (
              <View style={{ padding: 12, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12 }}>
                <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '700', textAlign: 'center' }}>{error}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { if (!isDeleting) { setShowConfirmDelete(false); setError(null); } }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6b7280' }}>Keep My Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                disabled={isDeleting}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', opacity: isDeleting ? 0.6 : 1 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Delete Everything</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
