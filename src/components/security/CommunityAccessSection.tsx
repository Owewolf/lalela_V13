import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Users, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';

export const CommunityAccessSection: React.FC = () => {
  const router = useRouter();
  const { communities, setCurrentCommunity } = useCommunity();

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 24, gap: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(37,99,235,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={22} color="#2563eb" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0d3d47' }}>Community Access</Text>
      </View>

      <View style={{ gap: 10 }}>
        {communities.map((community) => (
          <TouchableOpacity
            key={community.id}
            onPress={() => {
              setCurrentCommunity(community.id);
              // Navigate to community dashboard if that route exists
              // router.push(`/community/${community.id}`);
            }}
            style={{
              backgroundColor: '#f5f5f5',
              borderRadius: 20,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 48, height: 48, borderRadius: 16,
                backgroundColor: 'rgba(22,163,74,0.1)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#0d3d47' }}>
                  {community.name.charAt(0)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }}>{community.name}</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {community.userRole || 'Member'}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
