import React, { useMemo, useState } from 'react';
import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { Building2, MapPin, Pencil, Plus, Power, Trash2 } from 'lucide-react-native';
import { useCommunity } from '../../context/CommunityContext';
import { Community, UserBusiness } from '../../types';
import CreateBusinessForm from './CreateBusinessForm';

interface ManageUserBusinessesProps {
  communities: Community[];
  currentCommunity?: Community | null;
}

const ManageUserBusinesses: React.FC<ManageUserBusinessesProps> = ({ communities, currentCommunity }) => {
  const { userBusinesses, updateUserBusiness, removeUserBusiness, deleteUserBusiness } = useCommunity();
  const [showForm, setShowForm] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<UserBusiness | null>(null);
  const [busyBusinessId, setBusyBusinessId] = useState<string | null>(null);

  const sortedBusinesses = useMemo(() => {
    return [...userBusinesses].sort((left, right) => {
      if ((left.status ?? 'ACTIVE') === (right.status ?? 'ACTIVE')) {
        return left.name.localeCompare(right.name);
      }
      return (left.status ?? 'ACTIVE') === 'ACTIVE' ? -1 : 1;
    });
  }, [userBusinesses]);

  const getCommunityNames = (business: UserBusiness) => {
    return communities
      .filter((community) => (business.communityIds ?? []).includes(community.id))
      .map((community) => community.name);
  };

  const openCreate = () => {
    setEditingBusiness(null);
    setShowForm(true);
  };

  const openEdit = (business: UserBusiness) => {
    setEditingBusiness(business);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBusiness(null);
  };

  const handleToggleStatus = async (business: UserBusiness) => {
    setBusyBusinessId(business.id);
    try {
      if ((business.status ?? 'ACTIVE') === 'ACTIVE') {
        await removeUserBusiness(business.id);
      } else {
        await updateUserBusiness({ ...business, status: 'ACTIVE' });
      }
    } catch {
      Alert.alert('Update failed', 'We could not update this business status.');
    } finally {
      setBusyBusinessId(null);
    }
  };

  const handleDelete = (business: UserBusiness) => {
    Alert.alert(
      'Delete business',
      `Delete ${business.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyBusinessId(business.id);
            try {
              await deleteUserBusiness(business.id);
            } catch {
              Alert.alert('Delete failed', 'We could not delete this business.');
            } finally {
              setBusyBusinessId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <View>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 2 }}>
            My Businesses
          </Text>
          <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            Create and manage the business profiles attached to your communities.
          </Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#0d3d47', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {sortedBusinesses.length === 0 ? (
        <TouchableOpacity
          onPress={openCreate}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(13,61,71,0.12)',
            borderStyle: 'dashed',
            padding: 22,
            gap: 14,
            alignItems: 'center',
          }}
        >
          <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(13,61,71,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={28} color="#0d3d47" />
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0d3d47' }}>Add your first business</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 18 }}>
              Share your service, shop, or project with the communities you belong to.
            </Text>
          </View>
          <View style={{ backgroundColor: '#0d3d47', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>
              Create Business
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={{ gap: 12 }}>
          {sortedBusinesses.map((business) => {
            const communityNames = getCommunityNames(business);
            const isActive = (business.status ?? 'ACTIVE') === 'ACTIVE';
            const isBusy = busyBusinessId === business.id;

            return (
              <View key={business.id} style={{ backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 16, gap: 14 }}>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ width: 78, height: 78, borderRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(13,61,71,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                    {business.image ? (
                      <Image source={{ uri: business.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 28 }}>{business.name.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a' }} numberOfLines={1}>
                          {business.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                          {business.category}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.12)' }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isActive ? '#059669' : '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
                          {isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, lineHeight: 18, color: '#4b5563' }} numberOfLines={3}>
                      {business.description}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MapPin size={12} color="#6b7280" />
                      <Text style={{ flex: 1, fontSize: 11, color: '#6b7280' }} numberOfLines={1}>
                        {business.address}
                      </Text>
                    </View>
                  </View>
                </View>

                {communityNames.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {communityNames.map((name) => (
                      <View key={`${business.id}-${name}`} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(13,61,71,0.07)' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#0d3d47' }}>{name}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => openEdit(business)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: '#f5f5f5' }}>
                    <Pencil size={16} color="#0d3d47" />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0d3d47', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => handleToggleStatus(business)} disabled={isBusy} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: isActive ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)' }}>
                    <Power size={16} color={isActive ? '#d97706' : '#059669'} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: isActive ? '#d97706' : '#059669', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {isBusy ? 'Saving' : isActive ? 'Pause' : 'Activate'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => handleDelete(business)} disabled={isBusy} style={{ width: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.1)' }}>
                    <Trash2 size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <CreateBusinessForm
        visible={showForm}
        business={editingBusiness}
        communities={communities}
        currentCommunity={currentCommunity}
        onClose={closeForm}
      />
    </View>
  );
};

export default ManageUserBusinesses;