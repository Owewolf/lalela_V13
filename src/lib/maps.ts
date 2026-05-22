import { Linking, Platform, Alert } from 'react-native';

export const openDirections = (lat: number, lng: number, label: string) => {
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
    android: `google.navigation:q=${lat},${lng}`
  });
  const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  if (url) {
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(fallbackUrl);
      }
    }).catch(() => Linking.openURL(fallbackUrl));
  } else {
    Linking.openURL(fallbackUrl);
  }
};

export const openStreetView = (lat: number, lng: number) => {
  const url = Platform.select({
    ios: `comgooglemaps://?cbll=${lat},${lng}&mapmode=streetview`,
    android: `google.streetview:cbll=${lat},${lng}`
  });
  const fallbackUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  if (url) {
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(fallbackUrl);
      }
    }).catch(() => Linking.openURL(fallbackUrl));
  } else {
    Linking.openURL(fallbackUrl);
  }
};

export const showMapOptions = (lat?: number, lng?: number, label?: string) => {
  if (!lat || !lng || !label) {
    Alert.alert('Location required', 'No exact location available for this place.');
    return;
  }

  Alert.alert(
    label,
    'Choose a map action:',
    [
      {
        text: 'Get Directions',
        onPress: () => openDirections(lat, lng, label),
      },
      {
        text: 'Street View',
        onPress: () => openStreetView(lat, lng),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ],
    { cancelable: true }
  );
};
