import { create } from 'zustand';
import {
  isAuth0Configured,
  refreshAccessToken,
  fetchUserInfo,
  logoutFromAuth0,
} from '../services/auth0';
import {
  storeRefreshToken,
  getRefreshToken,
  storeUserInfo,
  getUserInfo,
  clearAuthStorage,
  clearForceInteractiveAuth,
  getForceInteractiveAuth,
  storeForceInteractiveAuth,
} from '../storage/authStorage';
import { logError, logInfo, logWarn } from '../services/debugLog';

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
  authStatus: 'anonymous' | 'restoring' | 'authenticated';
  forceInteractiveAuth: boolean;
  authStateVersion: number;
  isInitialized: boolean;
  isRestoring: boolean;
  error: string | null;
  bootstrapFromStorage: () => Promise<string | null>;
  setAuthResult: (token: string, user: User, refreshToken?: string) => Promise<void>;
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
  authStatus: 'anonymous',
  forceInteractiveAuth: false,
  authStateVersion: 0,
  isInitialized: false,
  isRestoring: false,
  error: null,

  bootstrapFromStorage: async () => {
    try {
      logInfo('auth.store.bootstrap.start');
      const [storedRefreshToken, storedUserInfo, forceInteractiveAuth] = await Promise.all([
        getRefreshToken(),
        getUserInfo(),
        getForceInteractiveAuth(),
      ]);

      if (storedRefreshToken && storedUserInfo) {
        logInfo('auth.store.bootstrap.cached_session_found', {
          userId: storedUserInfo.sub,
          forceInteractiveAuth,
        });
        set({
          user: {
            sub: storedUserInfo.sub,
            email: storedUserInfo.email,
            name: storedUserInfo.name,
            picture: storedUserInfo.picture,
            username: storedUserInfo.username,
          },
          token: null,
          isAuthenticated: true,
          authStatus: 'restoring',
          forceInteractiveAuth,
          isInitialized: true,
          isRestoring: false,
          error: null,
        });

        return storedUserInfo.sub;
      }

      logInfo('auth.store.bootstrap.no_cached_session', { forceInteractiveAuth });
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        authStatus: 'anonymous',
        forceInteractiveAuth,
        isInitialized: true,
        isRestoring: false,
        error: null,
      });

      return null;
    } catch (error) {
      console.error('Error bootstrapping auth state:', error);
      logError('auth.store.bootstrap.error', error);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        authStatus: 'anonymous',
        forceInteractiveAuth: false,
        isInitialized: true,
        isRestoring: false,
        error: null,
      });
      return null;
    }
  },

  setAuthResult: async (token: string, user: User, refreshToken?: string) => {
    logInfo('auth.store.setAuthResult', { userId: user.sub, hasRefreshToken: Boolean(refreshToken) });
    set({
      token,
      user,
      isAuthenticated: true,
      authStatus: 'authenticated',
      forceInteractiveAuth: false,
      error: null,
    });

    // Persist refresh token and user info for session restoration
    if (refreshToken) {
      await storeRefreshToken(refreshToken);
    }
    await clearForceInteractiveAuth();
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
    logInfo('auth.store.logout.start');
    const nextAuthStateVersion = get().authStateVersion + 1;
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      authStatus: 'anonymous',
      forceInteractiveAuth: true,
      authStateVersion: nextAuthStateVersion,
      error: null,
    });

    await Promise.all([
      clearAuthStorage(),
      storeForceInteractiveAuth(true),
    ]);

    try {
      await logoutFromAuth0();
      logInfo('auth.store.logout.auth0_success');
    } catch (error) {
      logError('auth.store.logout.auth0_error', error);
      set({
        error: 'Signed out locally. If account switching still looks sticky, try again.',
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  // Restore auth state from storage on app start
  restoreAuthState: async () => {
    const authStateVersion = get().authStateVersion;
    logInfo('auth.store.restore.start', { authStateVersion });
    set({ isRestoring: true });

    try {
      const storedRefreshToken = await getRefreshToken();

      if (!storedRefreshToken) {
        logInfo('auth.store.restore.no_refresh_token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          authStatus: 'anonymous',
          forceInteractiveAuth: false,
          isInitialized: true,
          isRestoring: false,
        });
        return false;
      }

      // Attempt to refresh the access token
      const tokenResult = await refreshAccessToken(storedRefreshToken);
      if (get().authStateVersion !== authStateVersion) {
        logWarn('auth.store.restore.version_changed_after_refresh');
        return false;
      }

      if (!tokenResult) {
        logWarn('auth.store.restore.refresh_failed');
        // Refresh token expired or invalid, clear storage
        await clearAuthStorage();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          authStatus: 'anonymous',
          forceInteractiveAuth: false,
          isInitialized: true,
          isRestoring: false,
        });
        return false;
      }

      // Update stored refresh token if rotated
      if (tokenResult.refreshToken) {
        await storeRefreshToken(tokenResult.refreshToken);
      }

      // Fetch fresh user info
      const userInfo = await fetchUserInfo(tokenResult.accessToken);
      if (get().authStateVersion !== authStateVersion) {
        logWarn('auth.store.restore.version_changed_after_userinfo');
        return false;
      }

      if (!userInfo) {
        logWarn('auth.store.restore.userinfo_failed');
        await clearAuthStorage();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          authStatus: 'anonymous',
          forceInteractiveAuth: false,
          isInitialized: true,
          isRestoring: false,
        });
        return false;
      }

      // Get stored user info to preserve username
      const storedUserInfo = await getUserInfo();
      await clearForceInteractiveAuth();
      logInfo('auth.store.restore.success', { userId: userInfo.sub });

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
        authStatus: 'authenticated',
        forceInteractiveAuth: false,
        isInitialized: true,
        isRestoring: false,
        error: null,
      });

      return true;
    } catch (error) {
      console.error('Error restoring auth state:', error);
      logError('auth.store.restore.error', error);
      await clearAuthStorage();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        authStatus: 'anonymous',
        forceInteractiveAuth: false,
        isInitialized: true,
        isRestoring: false,
      });
      return false;
    }
  },

  // Refresh the current access token
  refreshToken: async () => {
    const authStateVersion = get().authStateVersion;
    logInfo('auth.store.refresh.start', { authStateVersion });
    const storedRefreshToken = await getRefreshToken();

    if (!storedRefreshToken) {
      logWarn('auth.store.refresh.no_refresh_token');
      return false;
    }

    const tokenResult = await refreshAccessToken(storedRefreshToken);
    if (get().authStateVersion !== authStateVersion) {
      logWarn('auth.store.refresh.version_changed');
      return false;
    }

    if (!tokenResult) {
      logWarn('auth.store.refresh.failed');
      // Force logout if refresh fails
      get().logout();
      return false;
    }

    // Update stored refresh token if rotated
    if (tokenResult.refreshToken) {
      await storeRefreshToken(tokenResult.refreshToken);
    }

    await clearForceInteractiveAuth();
    logInfo('auth.store.refresh.success');

    set({
      token: tokenResult.accessToken,
      authStatus: 'authenticated',
      forceInteractiveAuth: false,
    });
    return true;
  },
}));
