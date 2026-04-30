import { useLocalSearchParams } from 'expo-router';

export default function EmergencyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const EmergencyHub = require('../../src/components/emergency/EmergencyHub').default;

  return <EmergencyHub emergencyId={id} />;
}
