import { create } from 'zustand';
import {
  isAuth0Configured,
  refreshAccessToken,
  fetchUserInfo,
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
import type { SyncIdentityResponse } from '../types';
import {
  ClientIdentityStatus,
  resolveStoredIdentityStatus,
} from '../../shared/clientIdentityPolicy';
import type { AvatarId } from '../../shared/avatarCatalog';

interface User {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  username?: string;
  usernameRequired?: boolean;
  onboardingStatus?: 'username_required' | 'complete';
  avatarId?: AvatarId;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuth0Available: boolean;
  authStatus: 'anonymous' | 'restoring' | 'authenticated' | 'reauthRequired';
  authSyncStatus: 'idle' | 'syncing' | 'ready' | 'failed';
  authSyncSource: 'login' | 'restore' | null;
  authSyncError: string | null;
  identityStatus: ClientIdentityStatus;
  identityError: string | null;
  identitySource: 'login' | 'restore' | null;
  restoredShellEligible: boolean;
  forceInteractiveAuth: boolean;
  authStateVersion: number;
  isInitialized: boolean;
  isRestoring: boolean;
  error: string | null;
  bootstrapFromStorage: () => Promise<string | null>;
  setAuthResult: (token: string, user: User, refreshToken?: string) => Promise<void>;
  beginIdentitySync: (source: 'login' | 'restore') => void;
  applyIdentity: (identity: SyncIdentityResponse) => Promise<void>;
  applyAvatar: (avatarId: AvatarId) => Promise<void>;
  failIdentitySync: (message: string) => void;
  requireUsernameOnboarding: () => void;
  beginAuthSync: (source: 'login' | 'restore') => void;
  finishAuthSync: () => void;
  failAuthSync: (message: string) => void;
  requireReauth: (message: string) => void;
  logout: () => Promise<void>;
  clearError: () => void;
  restoreAuthState: () => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
}

let inflightRefreshToken: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isAuth0Available: isAuth0Configured(),
  authStatus: 'anonymous',
  authSyncStatus: 'idle',
  authSyncSource: null,
  authSyncError: null,
  identityStatus: 'unknown',
  identityError: null,
  identitySource: null,
  restoredShellEligible: false,
  forceInteractiveAuth: false,
  authStateVersion: 0,
  isInitialized: false,
  isRestoring: false,
  error: null,

  bootstrapFromStorage: async () => {
    try {
      logInfo('auth.store.bootstrap.start');
      logInfo('auth.store.bootstrap.read_refresh_token.start');
      const refreshTokenPromise = getRefreshToken().then((value) => {
        logInfo('auth.store.bootstrap.read_refresh_token.success', { hasRefreshToken: Boolean(value) });
        return value;
      });
      logInfo('auth.store.bootstrap.read_user_info.start');
      const userInfoPromise = getUserInfo().then((value) => {
        logInfo('auth.store.bootstrap.read_user_info.success', { hasUserInfo: Boolean(value) });
        return value;
      });
      logInfo('auth.store.bootstrap.read_force_interactive.start');
      const forceInteractivePromise = getForceInteractiveAuth().then((value) => {
        logInfo('auth.store.bootstrap.read_force_interactive.success', { forceInteractiveAuth: value });
        return value;
      });

      const [storedRefreshToken, storedUserInfo, forceInteractiveAuth] = await Promise.all([
        refreshTokenPromise,
        userInfoPromise,
        forceInteractivePromise,
      ]);

      if (storedRefreshToken && storedUserInfo) {
        const storedIdentityStatus = resolveStoredIdentityStatus(storedUserInfo);
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
            usernameRequired: storedUserInfo.usernameRequired,
            onboardingStatus: storedUserInfo.onboardingStatus,
            avatarId: storedUserInfo.avatarId,
          },
          token: null,
          isAuthenticated: true,
          authStatus: 'restoring',
          authSyncStatus: 'idle',
          authSyncSource: null,
          authSyncError: null,
          identityStatus: storedIdentityStatus,
          identityError: null,
          identitySource: 'restore',
          restoredShellEligible: storedIdentityStatus === 'complete',
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
        authSyncStatus: 'idle',
        authSyncSource: null,
        authSyncError: null,
        identityStatus: 'unknown',
        identityError: null,
        identitySource: null,
        restoredShellEligible: false,
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
        authSyncStatus: 'idle',
        authSyncSource: null,
        authSyncError: null,
        identityStatus: 'unknown',
        identityError: null,
        identitySource: null,
        restoredShellEligible: false,
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
    const nextAuthStateVersion = get().authStateVersion + 1;
    set({
      token,
      user,
      isAuthenticated: true,
      authStatus: 'authenticated',
      authSyncStatus: 'idle',
      authSyncSource: null,
      authSyncError: null,
      identityStatus: 'unknown',
      identityError: null,
      identitySource: null,
      restoredShellEligible: false,
      forceInteractiveAuth: false,
      authStateVersion: nextAuthStateVersion,
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
      usernameRequired: user.usernameRequired,
      onboardingStatus: user.onboardingStatus,
      avatarId: user.avatarId,
    });
  },

  beginIdentitySync: (source) => {
    set({
      identityStatus: 'syncing',
      identityError: null,
      identitySource: source,
    });
  },

  applyIdentity: async (identity) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const updatedUser: User = {
      ...currentUser,
      username: identity.username || undefined,
      usernameRequired: identity.usernameRequired,
      onboardingStatus: identity.onboardingStatus,
      avatarId: identity.avatarId,
    };
    set({
      user: updatedUser,
      identityStatus: identity.usernameRequired ? 'username_required' : 'complete',
      identityError: null,
      restoredShellEligible: identity.usernameRequired ? false : get().restoredShellEligible,
    });
    await storeUserInfo({
      sub: updatedUser.sub,
      email: updatedUser.email,
      name: updatedUser.name,
      picture: updatedUser.picture,
      username: updatedUser.username,
      usernameRequired: updatedUser.usernameRequired,
      onboardingStatus: updatedUser.onboardingStatus,
      avatarId: updatedUser.avatarId,
    });
  },

  applyAvatar: async (avatarId) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updatedUser = { ...currentUser, avatarId };
    set({ user: updatedUser });
    await storeUserInfo({
      sub: updatedUser.sub,
      email: updatedUser.email,
      name: updatedUser.name,
      picture: updatedUser.picture,
      username: updatedUser.username,
      usernameRequired: updatedUser.usernameRequired,
      onboardingStatus: updatedUser.onboardingStatus,
      avatarId: updatedUser.avatarId,
    });
  },

  failIdentitySync: (message) => {
    set({
      identityStatus: 'failed',
      identityError: message,
    });
  },

  requireUsernameOnboarding: () => {
    set((state) => ({
      identityStatus: 'username_required',
      identityError: null,
      restoredShellEligible: false,
      user: state.user
        ? {
            ...state.user,
            usernameRequired: true,
            onboardingStatus: 'username_required',
          }
        : null,
    }));
  },

  beginAuthSync: (source: 'login' | 'restore') => {
    set({
      authSyncStatus: 'syncing',
      authSyncSource: source,
      authSyncError: null,
    });
  },

  finishAuthSync: () => {
    set({
      authSyncStatus: 'ready',
      authSyncSource: null,
      authSyncError: null,
    });
  },

  failAuthSync: (message: string) => {
    set({
      authSyncStatus: 'failed',
      authSyncSource: null,
      authSyncError: message,
    });
  },

  requireReauth: (message: string) => {
    set({
      token: null,
      authStatus: 'reauthRequired',
      authSyncStatus: 'failed',
      authSyncSource: null,
      authSyncError: message,
      error: message,
      restoredShellEligible: false,
    });
  },

  logout: async () => {
    logInfo('auth.store.logout.start');
    const nextAuthStateVersion = get().authStateVersion + 1;
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      authStatus: 'anonymous',
      authSyncStatus: 'idle',
      authSyncSource: null,
      authSyncError: null,
      identityStatus: 'unknown',
      identityError: null,
      identitySource: null,
      restoredShellEligible: false,
      forceInteractiveAuth: true,
      authStateVersion: nextAuthStateVersion,
      error: null,
    });

    await Promise.all([
      clearAuthStorage(),
      storeForceInteractiveAuth(true),
    ]);

    logInfo('auth.store.logout.local_only');
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
      logInfo('auth.store.restore.read_refresh_token.start');
      const storedRefreshToken = await getRefreshToken();
      logInfo('auth.store.restore.read_refresh_token.success', { hasRefreshToken: Boolean(storedRefreshToken) });

      if (!storedRefreshToken) {
        logInfo('auth.store.restore.no_refresh_token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          authStatus: 'anonymous',
          authSyncStatus: 'idle',
          authSyncSource: null,
          authSyncError: null,
          identityStatus: 'unknown',
          identityError: null,
          identitySource: null,
          restoredShellEligible: false,
          forceInteractiveAuth: false,
          authStateVersion: get().authStateVersion + (get().isAuthenticated ? 1 : 0),
          isInitialized: true,
          isRestoring: false,
        });
        return false;
      }

      // Attempt to refresh the access token
      logInfo('auth.store.restore.refresh_access_token.start');
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
          authSyncStatus: 'idle',
          authSyncSource: null,
          authSyncError: null,
          identityStatus: 'unknown',
          identityError: null,
          identitySource: null,
          restoredShellEligible: false,
          forceInteractiveAuth: false,
          authStateVersion: get().authStateVersion + (get().isAuthenticated ? 1 : 0),
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
      logInfo('auth.store.restore.fetch_user_info.start');
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
          authSyncStatus: 'idle',
          authSyncSource: null,
          authSyncError: null,
          identityStatus: 'unknown',
          identityError: null,
          identitySource: null,
          restoredShellEligible: false,
          forceInteractiveAuth: false,
          authStateVersion: get().authStateVersion + (get().isAuthenticated ? 1 : 0),
          isInitialized: true,
          isRestoring: false,
        });
        return false;
      }

      // Get stored user info to preserve username
      logInfo('auth.store.restore.read_cached_user_info.start');
      const storedUserInfo = await getUserInfo();
      logInfo('auth.store.restore.read_cached_user_info.success', { hasUserInfo: Boolean(storedUserInfo) });
      if (storedUserInfo?.sub && storedUserInfo.sub !== userInfo.sub) {
        logWarn('auth.store.restore.ownership_mismatch');
        await clearAuthStorage();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          authStatus: 'anonymous',
          authSyncStatus: 'idle',
          authSyncSource: null,
          authSyncError: null,
          identityStatus: 'unknown',
          identityError: null,
          identitySource: null,
          restoredShellEligible: false,
          forceInteractiveAuth: true,
          authStateVersion: get().authStateVersion + 1,
          isInitialized: true,
          isRestoring: false,
          error: 'Your saved account changed. Sign in again to continue.',
        });
        return false;
      }
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
          usernameRequired: storedUserInfo?.usernameRequired,
          onboardingStatus: storedUserInfo?.onboardingStatus,
          avatarId: storedUserInfo?.avatarId,
        },
        isAuthenticated: true,
        authStatus: 'authenticated',
        authSyncStatus: 'idle',
        authSyncSource: null,
        authSyncError: null,
        identityStatus: resolveStoredIdentityStatus(storedUserInfo || {}),
        identityError: null,
        identitySource: 'restore',
        restoredShellEligible:
          storedUserInfo !== null &&
          resolveStoredIdentityStatus(storedUserInfo) === 'complete',
        forceInteractiveAuth: false,
        isInitialized: true,
        isRestoring: false,
        error: null,
      });

      return true;
    } catch (error) {
      console.error('Error restoring auth state:', error);
      logError('auth.store.restore.error', error);
      if (get().authStateVersion === authStateVersion) {
        set({
          token: null,
          authStatus: 'restoring',
          authSyncStatus: 'failed',
          authSyncSource: null,
          authSyncError: 'Account data could not refresh.',
          isInitialized: true,
          isRestoring: false,
        });
      }
      return false;
    }
  },

  // Refresh the current access token
  refreshToken: async () => {
    if (inflightRefreshToken) {
      logWarn('auth.store.refresh.reused_inflight');
      return inflightRefreshToken;
    }

    inflightRefreshToken = (async () => {
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
        get().requireReauth('Session expired. Sign in again to refresh.');
        return false;
      }

      // Update stored refresh token if rotated
      if (tokenResult.refreshToken) {
        await storeRefreshToken(tokenResult.refreshToken);
      }

      const userInfo = await fetchUserInfo(tokenResult.accessToken);
      if (get().authStateVersion !== authStateVersion) {
        logWarn('auth.store.refresh.version_changed_after_userinfo');
        return false;
      }

      if (!userInfo || userInfo.sub !== get().user?.sub) {
        logWarn('auth.store.refresh.userinfo_failed');
        get().requireReauth('Session expired. Sign in again to refresh.');
        return false;
      }

      await clearForceInteractiveAuth();
      logInfo('auth.store.refresh.success');

      set({
        token: tokenResult.accessToken,
        authStatus: 'authenticated',
        forceInteractiveAuth: false,
      });
      return true;
    })().finally(() => {
      inflightRefreshToken = null;
    });

    return inflightRefreshToken;
  },
}));
