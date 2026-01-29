import { create } from 'zustand';
import { isAuth0Configured, refreshAccessToken, fetchUserInfo } from '../services/auth0';
import {
  storeRefreshToken,
  getRefreshToken,
  storeUserInfo,
  getUserInfo,
  clearAuthStorage,
} from '../storage/authStorage';

interface User {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  username?: string;
  usernameRequired?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuth0Available: boolean;
  isInitialized: boolean;
  isRestoring: boolean;
  error: string | null;
  setAuthResult: (token: string, user: User, refreshToken?: string) => void;
  setUsername: (username: string) => void;
  setDisplayName: (name: string) => void;
  setUsernameRequired: (required: boolean) => void;
  logout: () => Promise<void>;
  clearError: () => void;
  restoreAuthState: () => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isAuth0Available: isAuth0Configured(),
  isInitialized: false,
  isRestoring: false,
  error: null,

  setAuthResult: async (token: string, user: User, refreshToken?: string) => {
    set({
      token,
      user,
      isAuthenticated: true,
      error: null,
    });

    // Persist refresh token and user info for session restoration
    if (refreshToken) {
      await storeRefreshToken(refreshToken);
    }
    await storeUserInfo({
      sub: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
      username: user.username,
    });
  },

  setUsername: (username: string) => {
    set((state) => {
      const updatedUser = state.user
        ? { ...state.user, username, usernameRequired: false }
        : null;

      // Persist updated user info
      if (updatedUser) {
        storeUserInfo({
          sub: updatedUser.sub,
          email: updatedUser.email,
          name: updatedUser.name,
          picture: updatedUser.picture,
          username: updatedUser.username,
        });
      }

      return { user: updatedUser };
    });
  },

  setDisplayName: (name: string) => {
    set((state) => {
      const updatedUser = state.user ? { ...state.user, name } : null;

      // Persist updated user info
      if (updatedUser) {
        storeUserInfo({
          sub: updatedUser.sub,
          email: updatedUser.email,
          name: updatedUser.name,
          picture: updatedUser.picture,
          username: updatedUser.username,
        });
      }

      return { user: updatedUser };
    });
  },

  setUsernameRequired: (required: boolean) => {
    set((state) => ({
      user: state.user ? { ...state.user, usernameRequired: required } : null,
    }));
  },

  logout: async () => {
    // Clear stored auth data
    await clearAuthStorage();

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },

  // Restore auth state from storage on app start
  restoreAuthState: async () => {
    set({ isRestoring: true });

    try {
      const storedRefreshToken = await getRefreshToken();

      if (!storedRefreshToken) {
        set({ isInitialized: true, isRestoring: false });
        return false;
      }

      // Attempt to refresh the access token
      const tokenResult = await refreshAccessToken(storedRefreshToken);

      if (!tokenResult) {
        // Refresh token expired or invalid, clear storage
        await clearAuthStorage();
        set({ isInitialized: true, isRestoring: false });
        return false;
      }

      // Update stored refresh token if rotated
      if (tokenResult.refreshToken) {
        await storeRefreshToken(tokenResult.refreshToken);
      }

      // Fetch fresh user info
      const userInfo = await fetchUserInfo(tokenResult.accessToken);

      if (!userInfo) {
        await clearAuthStorage();
        set({ isInitialized: true, isRestoring: false });
        return false;
      }

      // Get stored user info to preserve username
      const storedUserInfo = await getUserInfo();

      set({
        token: tokenResult.accessToken,
        user: {
          sub: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          username: storedUserInfo?.username,
        },
        isAuthenticated: true,
        isInitialized: true,
        isRestoring: false,
        error: null,
      });

      return true;
    } catch (error) {
      console.error('Error restoring auth state:', error);
      await clearAuthStorage();
      set({ isInitialized: true, isRestoring: false });
      return false;
    }
  },

  // Refresh the current access token
  refreshToken: async () => {
    const storedRefreshToken = await getRefreshToken();

    if (!storedRefreshToken) {
      return false;
    }

    const tokenResult = await refreshAccessToken(storedRefreshToken);

    if (!tokenResult) {
      // Force logout if refresh fails
      get().logout();
      return false;
    }

    // Update stored refresh token if rotated
    if (tokenResult.refreshToken) {
      await storeRefreshToken(tokenResult.refreshToken);
    }

    set({ token: tokenResult.accessToken });
    return true;
  },
}));