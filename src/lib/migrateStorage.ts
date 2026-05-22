import AsyncStorage from '@react-native-async-storage/async-storage';

const SENTINEL = 'storageMigratedV1';

const MIGRATIONS: [string, string][] = [
  ['access_token', 'accessToken'],
  ['refresh_token', 'refreshToken'],
  ['user_profile', 'userProfile'],
  ['pending_reg_name', 'pendingRegName'],
  ['pending_reg_first_name', 'pendingRegFirstName'],
  ['pending_reg_last_name', 'pendingRegLastName'],
  ['pending_reg_agreed', 'pendingRegAgreed'],
  ['pending_reg_marketing', 'pendingRegMarketing'],
  ['pending_reg_email', 'pendingRegEmail'],
  ['pending_onboarding_mode', 'pendingOnboardingMode'],
  ['pending_onboarding_name', 'pendingOnboardingName'],
  ['pending_onboarding_email', 'pendingOnboardingEmail'],
  ['pending_onboarding_phone', 'pendingOnboardingPhone'],
  ['pending_onboarding_contact', 'pendingOnboardingContact'],
  ['pending_onboarding_invite', 'pendingOnboardingInvite'],
  ['pending_join_code', 'pendingJoinCode'],
];

/**
 * One-time migration: moves snake_case AsyncStorage keys to camelCase.
 * Safe to call on every boot — idempotent after the first run (sentinel key).
 */
export async function migrateAsyncStorageKeys(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(SENTINEL);
    if (done === 'true') return;

    const oldKeys = MIGRATIONS.map(([old]) => old);
    const values = await AsyncStorage.multiGet(oldKeys);

    const toSet: [string, string][] = [];
    const toRemove: string[] = [];

    for (let i = 0; i < MIGRATIONS.length; i++) {
      const [oldKey, newKey] = MIGRATIONS[i];
      const value = values[i][1];
      if (value !== null) {
        toSet.push([newKey, value]);
        toRemove.push(oldKey);
      }
    }

    if (toSet.length > 0) await AsyncStorage.multiSet(toSet);
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);

    await AsyncStorage.setItem(SENTINEL, 'true');
  } catch {
    // Never block the app on migration failure
  }
}
