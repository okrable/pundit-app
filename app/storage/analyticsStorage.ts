import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { isAnalyticsId } from '../../shared/analytics';

const ANALYTICS_ID_KEY = '@pundit_analytics_id';
const ANALYTICS_ENABLED_KEY = '@pundit_analytics_enabled';

let cachedAnalyticsId: string | null | undefined;
let cachedAnalyticsEnabled: boolean | undefined;
let inflightAnalyticsId: Promise<string> | null = null;

export async function isProductAnalyticsEnabled(): Promise<boolean> {
  if (cachedAnalyticsEnabled !== undefined) return cachedAnalyticsEnabled;

  const stored = await AsyncStorage.getItem(ANALYTICS_ENABLED_KEY);
  cachedAnalyticsEnabled = stored !== 'false';
  return cachedAnalyticsEnabled;
}

export async function setProductAnalyticsEnabled(enabled: boolean): Promise<void> {
  cachedAnalyticsEnabled = enabled;
  await AsyncStorage.setItem(ANALYTICS_ENABLED_KEY, String(enabled));
}

export async function getOrCreateAnalyticsId(): Promise<string> {
  if (cachedAnalyticsId) return cachedAnalyticsId;
  if (inflightAnalyticsId) return inflightAnalyticsId;

  inflightAnalyticsId = (async () => {
    const stored = await AsyncStorage.getItem(ANALYTICS_ID_KEY);
    if (isAnalyticsId(stored)) {
      cachedAnalyticsId = stored;
      return stored;
    }

    const analyticsId = Crypto.randomUUID();
    await AsyncStorage.setItem(ANALYTICS_ID_KEY, analyticsId);
    cachedAnalyticsId = analyticsId;
    return analyticsId;
  })().finally(() => {
    inflightAnalyticsId = null;
  });

  return inflightAnalyticsId;
}

export async function resetAnalyticsIdentity(): Promise<void> {
  const pendingIdentity = inflightAnalyticsId;
  if (pendingIdentity) {
    await pendingIdentity.catch(() => undefined);
  }
  cachedAnalyticsId = null;
  inflightAnalyticsId = null;
  await AsyncStorage.removeItem(ANALYTICS_ID_KEY);
}
