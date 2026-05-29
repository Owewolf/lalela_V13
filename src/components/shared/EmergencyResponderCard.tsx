import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ViewStyle, Alert } from 'react-native';
import { Siren, ShieldCheck } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useCommunity } from '../../context/CommunityContext';
import CardSurface from './CardSurface';
import { THEME_COLORS } from '../../theme/colors';

interface EmergencyResponderCardProps {
  style?: ViewStyle;
}

const EmergencyResponderCard: React.FC<EmergencyResponderCardProps> = ({ style }) => {
  const { communities, toggleCommunityResponder, shareSecurityLocation, clearSecurityLocation } = useCommunity();
  const [showResponderSelector, setShowResponderSelector] = useState(false);
  const [pendingCommunityId, setPendingCommunityId] = useState<string | null>(null);

  const getBestResponderCoords = async (): Promise<Location.LocationObjectCoords | null> => {
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });
      return current.coords;
    } catch {
      const lastKnown = await Location.getLastKnownPositionAsync();
      return lastKnown?.coords ?? null;
    }
  };

  const handleResponderToggle = async (communityId: string, nextValue: boolean) => {
    if (pendingCommunityId) return;

    setPendingCommunityId(communityId);
    try {
      if (nextValue) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Location permission is required to share your responder position.');
          return;
        }

        await toggleCommunityResponder(communityId, true, { emergencyLocationOptIn: true });
        const coords = await getBestResponderCoords();
        if (!coords) {
          Alert.alert(
            'Emergency responder',
            'Responder enabled, but your current location could not be captured yet. Enable location services and toggle again to publish location.'
          );
          return;
        }
        await shareSecurityLocation(communityId, coords.latitude, coords.longitude);
        return;
      }

      await toggleCommunityResponder(communityId, false, { emergencyLocationOptIn: false });
      await clearSecurityLocation(communityId);
    } catch (error: any) {
      if (nextValue) {
        try {
          await clearSecurityLocation(communityId);
        } catch {
          // Ignore rollback cleanup errors.
        }
        try {
          await toggleCommunityResponder(communityId, false, { emergencyLocationOptIn: false });
        } catch {
          // Ignore rollback cleanup errors.
        }
      } else {
        try {
          await toggleCommunityResponder(communityId, true, { emergencyLocationOptIn: true });
        } catch {
          // Ignore rollback cleanup errors.
        }
      }
      const serverMessage = error?.response?.data?.error;
      const clientMessage = typeof error?.message === 'string' ? error.message : null;
      const fallbackMessage = 'Could not update responder sharing for this community.';
      Alert.alert(
        'Emergency responder',
        typeof serverMessage === 'string' && serverMessage.trim().length > 0
          ? serverMessage
          : (clientMessage && clientMessage.trim().length > 0 ? `${fallbackMessage}\n${clientMessage}` : fallbackMessage)
      );
    } finally {
      setPendingCommunityId(null);
    }
  };

  return (
    <View
      style={[
        {
          backgroundColor: THEME_COLORS.surfaceContainer,
          borderRadius: 24,
          padding: 20,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: THEME_COLORS.errorTintSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Siren size={18} color={THEME_COLORS.errorStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: THEME_COLORS.onSurface }}>Emergency Responder</Text>
            <Text style={{ fontSize: 11, color: THEME_COLORS.neutralTextSoft }}>Receive and respond to community alerts</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowResponderSelector(!showResponderSelector)}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: showResponderSelector ? THEME_COLORS.primaryContainer : THEME_COLORS.primary,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: THEME_COLORS.white, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Manage
          </Text>
        </TouchableOpacity>
      </View>

      {showResponderSelector && (
        <View style={{ marginTop: 16, gap: 8, backgroundColor: THEME_COLORS.surface, borderRadius: 16, padding: 16 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: THEME_COLORS.neutralTextSubtle, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Select Communities
          </Text>
          <Text style={{ fontSize: 10, color: THEME_COLORS.neutralTextSoft, marginBottom: 8 }}>
            Enabling a community makes your emergency location visible in that community during emergencies. Disable to hide your location and opt out there.
          </Text>
          {communities.map((community) => (
            <CardSurface
              key={community.id}
              surfaceVariant="subtle"
              borderVariant="default"
              shadowVariant="none"
              radius={12}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <CardSurface
                  surfaceVariant="muted"
                  borderVariant="none"
                  shadowVariant="none"
                  radius={8}
                  style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ShieldCheck size={16} color={THEME_COLORS.primary} />
                </CardSurface>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: THEME_COLORS.onSurface }}>{community.name}</Text>
                  <Text style={{ fontSize: 10, color: THEME_COLORS.neutralTextSoft }}>
                    {community.isSecurityMember
                      ? 'Emergency location visible for this community'
                      : 'Emergency location hidden for this community'}
                  </Text>
                </View>
              </View>
              <Switch
                value={!!community.isSecurityMember}
                onValueChange={(val) => handleResponderToggle(community.id, val)}
                trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
                thumbColor={THEME_COLORS.white}
                disabled={pendingCommunityId === community.id}
              />
            </CardSurface>
          ))}
        </View>
      )}
    </View>
  );
};

export default EmergencyResponderCard;
