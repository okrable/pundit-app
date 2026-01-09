import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = '@pundit_user_id';

export async function getUserId(): Promise<string> {
  try {
    const userId = await AsyncStorage.getItem(USER_ID_KEY);
    if (userId) {
      return userId;
    }

    // Generate a new guest user ID
    const newUserId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem(USER_ID_KEY, newUserId);
    return newUserId;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export async function setUserId(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  } catch (error) {
    console.error('Error setting user ID:', error);
  }
}

export async function clearUserId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_ID_KEY);
  } catch (error) {
    console.error('Error clearing user ID:', error);
  }
}
