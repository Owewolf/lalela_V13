import React, { useState, useEffect } from 'react';
import { View, Text, Switch } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import LocationPickerSection from '../shared/LocationPickerSection';

interface LocationSettingsProps {
  isEditing?: boolean;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  onLocationChange?: (location: { name: string; latitude: number; longitude: number }) => void;
}

export const LocationSettings: React.FC<LocationSettingsProps> = ({
  isEditing = false,
  locationName,
  latitude,
  longitude,
  onLocationChange,
}) => {
  const { userProfile, updateUserProfile } = useAuth();

  const [localLocationName, setLocalLocationName] = useState(
    locationName || userProfile?.defaultLocation?.name || ''
  );
  const [localLatitude, setLocalLatitude] = useState(
    latitude ?? userProfile?.defaultLocation?.latitude ?? 0
  );
  const [localLongitude, setLocalLongitude] = useState(
    longitude ?? userProfile?.defaultLocation?.longitude ?? 0
  );

  useEffect(() => {
    if (!isEditing && userProfile?.defaultLocation) {
      setLocalLocationName(userProfile.defaultLocation.name);
      setLocalLatitude(userProfile.defaultLocation.latitude);
      setLocalLongitude(userProfile.defaultLocation.longitude);
    }
  }, [userProfile?.defaultLocation, isEditing]);

  useEffect(() => {
    if (isEditing) {
      if (locationName !== undefined) setLocalLocationName(locationName);
      if (latitude !== undefined) setLocalLatitude(latitude);
      if (longitude !== undefined) setLocalLongitude(longitude);
    }
  }, [locationName, latitude, longitude, isEditing]);

  return (
    <View className="pt-4 border-t border-gray-100 gap-y-4">
      {/* Header with sharing toggle */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center">
            <MapPin size={18} color="#0d3d47" />
          </View>
          <View>
            <Text className="text-sm font-bold text-gray-900">Default Location</Text>
            <Text className="text-[10px] text-gray-500">Auto-attach to new posts and businesses</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {userProfile?.locationSharing ? 'On' : 'Off'}
          </Text>
          <Switch
            value={!!userProfile?.locationSharing}
            onValueChange={(val) => updateUserProfile({ locationSharing: val })}
            trackColor={{ false: '#d1d5db', true: '#0d3d47' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Read-only address when not editing; full picker only in edit mode */}
      {isEditing ? (
        <LocationPickerSection
          value={{
            address: localLocationName,
            latitude: localLatitude !== 0 ? localLatitude : undefined,
            longitude: localLongitude !== 0 ? localLongitude : undefined,
          }}
          onChange={(next) => {
            const lat = next.latitude ?? 0;
            const lng = next.longitude ?? 0;
            setLocalLocationName(next.address);
            setLocalLatitude(lat);
            setLocalLongitude(lng);
            const update = { name: next.address, latitude: lat, longitude: lng };
            onLocationChange?.(update);
          }}
          hint="Search first, then tap or drag the pin to fine-tune your exact address."
        />
      ) : (
        <View className="gap-y-1">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Address</Text>
          <View className="p-3 bg-gray-50 rounded-xl">
            <Text className="text-sm font-bold text-gray-900">
              {userProfile?.address || userProfile?.defaultLocation?.name || 'Not set'}
            </Text>
          </View>
          {!(userProfile?.address || userProfile?.defaultLocation?.name) && (
            <Text className="text-[10px] text-gray-400 italic px-1">
              Tap Edit Profile to set your address.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};
