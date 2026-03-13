import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REFRESH_TOKEN_KEY = 'pundit_refresh_token';
const USER_INFO_KEY = 'pundit_user_info';
const FORCE_INTERACTIVE_AUTH_KEY = 'pundit_force_interactive_auth';

// SecureStore is not available on web, so we use AsyncStorage as fallback
// Note: On web, tokens are less secure - consider server-side session management for production
const isSecureStoreAvailable = Platform.OS !== 'web';

export interface StoredUserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  username?: string;
}

export async function storeRefreshToken(token: string): Promise<void> {
  try {
    if (isSecureStoreAvailable) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } else {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
    }
  } catch (error) {
    console.error('Error storing refresh token:', error);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    if (isSecureStoreAvailable) {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } else {
      return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
}

export async function removeRefreshToken(): Promise<void> {
  try {
    if (isSecureStoreAvailable) {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } else {
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    console.error('Error removing refresh token:', error);
  }
}

export async function storeUserInfo(userInfo: StoredUserInfo): Promise<void> {
  try {
    const userInfoJson = JSON.stringify(userInfo);
    if (isSecureStoreAvailable) {
      await SecureStore.setItemAsync(USER_INFO_KEY, userInfoJson);
    } else {
      await AsyncStorage.setItem(USER_INFO_KEY, userInfoJson);
    }
  } catch (error) {
    console.error('Error storing user info:', error);
  }
}

export async function getUserInfo(): Promise<StoredUserInfo | null> {
  try {
    let userInfoJson: string | null;
    if (isSecureStoreAvailable) {
      userInfoJson = await SecureStore.getItemAsync(USER_INFO_KEY);
    } else {
      userInfoJson = await AsyncStorage.getItem(USER_INFO_KEY);
    }

    if (userInfoJson) {
      return JSON.parse(userInfoJson);
    }
    return null;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

export async function removeUserInfo(): Promise<void> {
  try {
    if (isSecureStoreAvailable) {
      await SecureStore.deleteItemAsync(USER_INFO_KEY);
    } else {
      await AsyncStorage.removeItem(USER_INFO_KEY);
    }
  } catch (error) {
    console.error('Error removing user info:', error);
  }
}

export async function clearAuthStorage(): Promise<void> {
  await Promise.all([
    removeRefreshToken(),
    removeUserInfo(),
  ]);
}

export async function storeForceInteractiveAuth(enabled: boolean): Promise<void> {
  try {
    const value = enabled ? 'true' : 'false';
    if (isSecureStoreAvailable) {
      await SecureStore.setItemAsync(FORCE_INTERACTIVE_AUTH_KEY, value);
    } else {
      await AsyncStorage.setItem(FORCE_INTERACTIVE_AUTH_KEY, value);
    }
  } catch (error) {
    console.error('Error storing interactive auth flag:', error);
  }
}

export async function getForceInteractiveAuth(): Promise<boolean> {
  try {
    let rawValue: string | null;
    if (isSecureStoreAvailable) {
      rawValue = await SecureStore.getItemAsync(FORCE_INTERACTIVE_AUTH_KEY);
    } else {
      rawValue = await AsyncStorage.getItem(FORCE_INTERACTIVE_AUTH_KEY);
    }

    return rawValue === 'true';
  } catch (error) {
    console.error('Error reading interactive auth flag:', error);
    return false;
  }
}

export async function clearForceInteractiveAuth(): Promise<void> {
  try {
    if (isSecureStoreAvailable) {
      await SecureStore.deleteItemAsync(FORCE_INTERACTIVE_AUTH_KEY);
    } else {
      await AsyncStorage.removeItem(FORCE_INTERACTIVE_AUTH_KEY);
    }
  } catch (error) {
    console.error('Error clearing interactive auth flag:', error);
  }
}
