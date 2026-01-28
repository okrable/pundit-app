import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = '@pundit_auth_token';
const AUTH_USER_KEY = '@pundit_auth_user';
const AUTH_REFRESH_TOKEN_KEY = '@pundit_auth_refresh_token';

export async function clearAuthStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      AUTH_TOKEN_KEY,
      AUTH_USER_KEY,
      AUTH_REFRESH_TOKEN_KEY,
    ]);
  } catch (error) {
    console.error('Error clearing auth storage:', error);
  }
}
